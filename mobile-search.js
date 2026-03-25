(function(){
function srch(q){
if(!window.algoliasearch){setTimeout(function(){srch(q);},300);return;}
var c=window.algoliasearch("E3WSWA1RJ6","f6fca2acd7672892699e91a42117a01b");
Promise.all([c.initIndex("www_exymesplc_com_e3wswa1rj6_pages").search(q,{hitsPerPage:6}),c.initIndex("exymesplc_pdfs").search(q,{hitsPerPage:4})]).then(function(r){
var ph=r[0].hits.filter(function(h){return!h.url||!h.url.includes("/team");});
show(q,ph.concat(r[1].hits));});}
function show(q,hits){
var old=document.getElementById("mr");if(old)old.remove();
var p=document.createElement("div");p.id="mr";
p.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:60vw;max-height:75vh;background:#fff;border-radius:12px;box-shadow:0 16px 64px rgba(14,55,71,0.3);z-index:999999;display:flex;flex-direction:column;overflow:hidden;font-family:Geist,sans-serif;";
var tb=document.createElement("div");
tb.style.cssText="display:flex;align-items:center;gap:12px;padding:14px 20px;background:#0E3747;flex-shrink:0;";
tb.innerHTML='<input id="mri" type="text" style="border:none;outline:none;background:transparent;font-size:14px;color:#fff;width:100%;caret-color:#fff;" placeholder="Search again..."/><button id="mrb" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;font-size:12px;padding:4px 10px;cursor:pointer;flex-shrink:0;">Search</button><button id="mrx" style="background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,0.6);padding:4px;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>';
var cb=document.createElement("div");cb.style.cssText="padding:8px 20px;font-size:12px;color:#5D6376;border-bottom:1px solid rgba(14,55,71,0.06);flex-shrink:0;";
cb.textContent=hits.length+' result'+(hits.length!==1?'s':'')+' for "'+q+'"';
var list=document.createElement("div");list.style.cssText="overflow-y:auto;flex:1;";
if(!hits.length){list.innerHTML='<div style="padding:40px;text-align:center;color:#5D6376;">No results</div>';}
else{hits.forEach(function(h){
var t=(h.headers&&h.headers[0])||h.title||"Untitled";
var d=h.description||"";var u=h.url||h.objectID||"";
var el=document.createElement("div");
el.style.cssText="padding:14px 20px;border-bottom:1px solid rgba(14,55,71,0.06);cursor:pointer;";
el.onmouseenter=function(){el.style.background="rgba(29,116,146,0.05)";};
el.onmouseleave=function(){el.style.background="transparent";};
el.onclick=function(){window.open(u,"_blank","noopener");p.remove();};
el.innerHTML=(u.includes("resources.exymesplc.com")?'<span style="font-size:10px;font-weight:600;color:#fff;background:#1D7492;border-radius:3px;padding:2px 6px;margin-bottom:4px;display:inline-block;">PDF</span><br>':'')+
'<div style="font-size:14px;font-weight:500;color:#0E3747;margin-bottom:2px;">'+t+'</div>'+
(d?'<div style="font-size:12px;color:#5D6376;line-height:1.5;margin-bottom:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+d+'</div>':'')+
'<div style="font-size:11px;color:#1D7492;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+u+'</div>';
list.appendChild(el);});}
p.appendChild(tb);p.appendChild(cb);p.appendChild(list);
document.body.appendChild(p);
document.getElementById("mrx").onclick=function(){p.remove();};
document.getElementById("mri").value=q;
function ds(){var nq=document.getElementById("mri").value.trim();if(nq){p.remove();srch(nq);}}
document.getElementById("mrb").onclick=ds;
document.getElementById("mri").onkeydown=function(e){if(e.key==="Enter")ds();};
document.addEventListener("keydown",function esc(e){if(e.key==="Escape"){p.remove();document.removeEventListener("keydown",esc);}});}
function inject(){
if(document.getElementById("mob-search-wrap"))return;
var cols=document.querySelectorAll('[data-framer-name="Nav Column"]');
if(!cols.length)return;
var w=document.createElement("div");w.id="mob-search-wrap";
w.style.cssText="display:flex;align-items:center;margin-top:16px;width:100%;";
var style=document.createElement("style");
style.textContent='#mob-search-input::placeholder{color:rgba(255,255,255,0.45);}#mob-search-icon-btn{background:transparent;border:none;cursor:pointer;padding:0;display:flex;}#mob-search-icon-btn.h{opacity:0;pointer-events:none;width:0;overflow:hidden;}#mob-search-bar{display:flex;align-items:center;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);border-radius:6px;padding:0;width:0;overflow:hidden;transition:all 0.25s ease;opacity:0;}#mob-search-bar.o{width:100%;padding:8px 12px;opacity:1;gap:10px;}#mob-search-input{border:none;outline:none;background:transparent;font-family:Geist,sans-serif;font-size:14px;color:#fff;width:100%;caret-color:#fff;}';
document.head.appendChild(style);
w.innerHTML='<button id="mob-search-icon-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.8)" fill="none" stroke-width="1.4"/><path d="m21 21-4.3-4.3" stroke="rgba(255,255,255,0.8)" fill="none" stroke-linecap="round"/></svg></button><div id="mob-search-bar"><input id="mob-search-input" type="text" placeholder="Search and press Enter..."/></div>';
cols[0].appendChild(w);
document.getElementById("mob-search-icon-btn").addEventListener("click",function(){
this.classList.add("h");
document.getElementById("mob-search-bar").classList.add("o");
setTimeout(function(){var i=document.getElementById("mob-search-input");if(i)i.focus();},260);});
document.getElementById("mob-search-input").addEventListener("keydown",function(e){
if(e.key==="Enter"&&this.value.trim())srch(this.value.trim());});}

// Poll every 200ms as well as using MutationObserver
var poll=setInterval(function(){
if(document.querySelectorAll('[data-framer-name="Nav Column"]').length){
inject();
}
},200);

// Stop polling after 30 seconds
setTimeout(function(){clearInterval(poll);},30000);

new MutationObserver(function(){
inject();
}).observe(document.body,{childList:true,subtree:true,attributes:true});

document.addEventListener("DOMContentLoaded",inject);
})();
