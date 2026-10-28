// CK 版队列引擎（与 tools/build_from_ck.py 的 run_task 等价）
// 用法：在 data: 页面里 var DATA=<接口JSON>; 本文件; document.write(run())
var CKURL = '://pages-fast.m.taobao.com/wow/z/tmtjb/town/home?x-ssr=true&disableNav=YES&pha_h5=true&pha_nav=true&uniapp_id=1011525&uniapp_page=home&hd_from=tmnc26618&prismChannel=poplayer&sceneId=8917&hd_from_id=100260';
var MAIN = 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.taobao.com';
var MAINW = 5;
var OUT = ['99673','99732','107021','106619','99667','99655','91224','101222','99653','99662','90782','101121','100531','90900'];
var MAXT = 3;
var WAIT = 25;

function run() {
    var model = (DATA && DATA.data && DATA.data.model) || [];
    var seq = [{ url: MAIN, wait: MAINW }];
    var made = 0;
    var skipped = [];
    for (var i = 0; i < model.length; i++) {
        var m = model[i];
        var p = m.progress || {};
        var tp = m.taskParams || {};
        var did = tp.deliveryId ? String(tp.deliveryId) : '';
        if (!did) continue;
        var need = Number(p.needTimes) || 0;
        if (need === 0) { skipped.push(did); continue; }
        var isOut = false;
        for (var k = 0; k < OUT.length; k++) { if (OUT[k] === did) { isOut = true; break; } }
        if (isOut) { skipped.push(did); continue; }
        var n = need > MAXT ? MAXT : need;
        var idx = Number(p.times) || 0;
        var parts = String(tp.implId || '').split('_');
        parts.pop();
        var prefix = parts.join('_');
        var tok = String(tp.fromToken || '');
        for (var j = 0; j < n; j++) {
            var impl = prefix + '_' + (idx + j);
            seq.push({ url: 'taobao' + CKURL + '&implId=' + impl + '&deliveryId=' + did + '&fromToken=' + tok, wait: WAIT });
            seq.push({ url: MAIN, wait: MAINW });
            made++;
        }
    }
    var lines = [];
    for (var z = 0; z < seq.length; z++) lines.push(seq[z].url + '|' + seq[z].wait);
    return lines.join('\n');
}
