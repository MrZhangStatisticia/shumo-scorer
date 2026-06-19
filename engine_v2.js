// ============================================================
// 数学建模论文评分引擎 v2.5 — 大幅抬基线，给分制
// 正则引擎天然偏严，因此基线从优设定，避免误伤
// 锚点: 祭酒 9.78 国一 → 引擎应给 8.8-9.5
// 纯浏览器运行，零外部依赖
// ============================================================

function scoreV2(text, pages, fname) {
  var S = {}; var F = {};
  var st = gatherStats(text);
  var ab = st.abstract, ap = ab || text.substring(0, 3000);

  // ===== A. 摘要 (1.50) — 基线: ~80% = 1.20 =====
  var qc=0,mc=0,rc=0;
  [/问题[一二三四]/g,/问题[1-4]/g,/分析.*分布/g,/分析.*关系/g,/制定.*策略/g,/确定.*方案/g].forEach(function(p){var m=ap.match(p);if(m)qc+=m.length;});
  [/建立.*模型/g,/构建.*模型/g,/采用.*方法/g,/利用.*算法/g,/通过.*分析/g,/引入.*模型/g,/提出.*方法/g].forEach(function(p){var m=ap.match(p);if(m)mc+=m.length;});
  [/(?:得到|求得|求解|结果为|计算得|发现|表明).*[0-9]/g,/[=＝]\s*\d+\.?\d*/g,/约?\d+\.?\d*\s*(?:千[克]|元|种|%|万)/g].forEach(function(p){var m=ap.match(p);if(m)rc+=m.length;});
  S.A1 = Math.min(0.45, 0.38 + 0.04*Math.min(qc,1) + 0.04*Math.min(mc,2) + 0.04*Math.min(rc,1));

  var allNums = (ap.match(/[=＝]\s*\d+\.?\d*|约?\d+\.?\d*\s*(?:千[克]|元|种|%|万)/g)||[]).length;
  S.A2 = Math.min(0.38, 0.30 + 0.04*Math.min(allNums,2));
  if(allNums<2) F.A2 = '摘要数值偏少('+allNums+'个)，国一标准每个问题后应有具体数值';

  var bgWords = 0;
  ['随着','近年来','我国','市场','行业','经济','消费者','企业'].forEach(function(w){if(ap.indexOf(w)!==-1)bgWords++;});
  S.A3 = Math.min(0.22, 0.18 + 0.02*bgWords);

  var innoC = (ap.match(/(?:构建了.*体系|提出.*方法|设计了.*框架|创新|特色|亮点)/g)||[]).length;
  S.A4 = Math.min(0.22, 0.14 + 0.04*Math.min(innoC,2));

  var al=st.abstract_chars;
  S.A5=(al>200&&al<800)?0.22:(al>=100&&al<1200)?0.18:0.14;

  // ===== B. 逻辑 (2.50) — 基线: ~80% = 2.00 =====
  var reqM=['问题重述','问题分析','模型假设','符号说明','模型建立','模型求解','模型检验','模型评价','参考文献','附录'];
  var fndM=[],misM=[];
  reqM.forEach(function(m){if(text.indexOf(m)!==-1)fndM.push(m);else misM.push(m);});
  S.B1=Math.max(0.32,0.40*fndM.length/reqM.length);
  if(misM.length>=4) F.B1='缺少模块: '+misM.join('、');

  var pa=st.problemAnalysis;
  var causalC=0;
  [/由于.*(?:因此|所以|故|选择)/g,/因为.*(?:选择|采用|建立)/g,/考虑到.*(?:特征|特点|约束)/g,/故.*(?:采用|选择|建立|使用)/g,/问题.*(?:本质|核心).*(?:是|在于)/g].forEach(function(p){var m=pa.match(p);if(m)causalC+=m.length;});
  var hasFC=/思路.*图|流程.*图|技术路线|如图|见图/.test(pa);
  S.B2=Math.min(0.60,0.44+0.04*Math.min(causalC,3)+0.04*hasFC);

  var trC=(text.match(/基于.*(?:上述|以上|问题.|分析|结果)/g)||[]).length+(text.match(/(?:为此|进一步|综上)/g)||[]).length;
  S.B3=Math.min(0.50,0.38+0.03*Math.min(trC,4));

  var asT=st.assumptions;
  var asN=(asT.match(/\n\s*\d+[\.\、\)）]/g)||[]).length;
  // Also detect "1. 2." style assumptions
  if(asN<2) asN=(asT.match(/\d+[\.\、）]\s*\S{5,}/g)||[]).length;
  var asI=asT.split(/\n\s*\d+[\.\、\)）]/).filter(function(s){return s.trim().length>0;});
  if(asI.length<2) asI=asT.split(/\d+[\.\、）]\s*/).filter(function(s){return s.trim().length>10;});
  var wellEx=0;asI.forEach(function(it){if(it.length>25)wellEx++;});
  S.B4=Math.min(0.50,0.35+0.08*Math.min(Math.max(asN,asI.length)/4,1)+0.07*(asN>0?wellEx/Math.max(asN,1):0));

  var layC=(text.match(/基于.*模型.*(?:进一步|扩展|建立)/g)||[]).length+(text.match(/将.*(?:应用于|扩展到|推广至)/g)||[]).length;
  S.B5=Math.min(0.50,0.36+0.04*Math.min(layC,3)+0.04*hasFC);

  // ===== C. 叙事 (2.50) — 基线: ~80% = 2.00 =====
  var lines=text.split('\n').map(function(l){return l.trim();}).filter(function(l){return l;});
  var fb=[],cb=0;
  for(var i=0;i<lines.length;i++){
    var hf=/[=＝∑∏∫∂√∞αβγδ]/.test(lines[i]);
    if(hf)cb++;else{if(cb>0){fb.push(cb);cb=0;}}
  }
  if(cb>0)fb.push(cb);
  var maxSt=fb.length>0?Math.max.apply(null,fb):0;
  S.C1=maxSt>=8?0.42:(maxSt>=5?0.48:0.56);
  if(maxSt>=6) F.C1='检测到连续公式堆砌('+maxSt+'行)，建议在公式间穿插文字解释';

  S.C2=/符号说明/.test(text)?0.36:0.28;

  var jC=0;
  [/由于.*(?:数据|问题).*(?:采用|选择|建立)/g,/考虑到.*(?:特点|特征).*(?:因此|采用)/g,/故.*(?:采用|选择|建立)/g,/传统.*(?:难以|无法).*(?:因此|本文)/g,/数据.*(?:非正态|非线性|相关).*(?:因此|选择)/g].forEach(function(p){var m=text.match(p);if(m)jC+=m.length;});
  S.C3=Math.min(0.60,0.42+0.04*Math.min(jC,4));

  var prT=st.preprocessing;
  var prS=(prT.match(/(?:缺失|异常|重复|清洗|处理|剔除|筛选|标准化)/g)||[]).length;
  S.C4=Math.min(0.50,0.34+0.04*Math.min(prS,3)+(/发现|检测到/.test(prT)?0.04:0));

  var uniq=new Set();
  (text.match(/\w{2,}(?:模型|算法|方法|网络|框架|体系|策略)/g)||[]).forEach(function(n){uniq.add(n);});
  S.C5=Math.min(0.40,0.30+0.03*Math.min(uniq.size,3));

  // ===== D. 可信度 (2.00) — 基线: ~70% = 1.40 =====
  var sensC=(text.match(/灵敏度|敏感性|鲁棒性|扰动|稳健性/g)||[]).length;
  var hasSQ=/变动率|变化率|扰动.*[%％]|±\s*\d+/.test(text);
  var hasVal=/验证|检验|测试.*(?:模型|结果)/.test(text.substring(Math.max(0,text.length-6000)));
  var hasCV=/对比|比较.*(?:传统|原有|基准|改进前)/.test(text);
  var hasGoodEval=st.evaluation.length>500; // detailed evaluation section
  if(sensC>=2&&hasSQ)S.D1=0.75;else if(sensC>=1)S.D1=0.60;else if(hasVal&&hasCV)S.D1=0.50;else if(hasVal||hasGoodEval)S.D1=0.40;else S.D1=0.22;
  if(S.D1<0.55) F.D1='缺少灵敏度分析。建议对关键参数做±10%扰动验证，或增加多模型对比——这是省奖→国奖的关键跳板';

  var stC=(text.match(/p\s*[<≤=]\s*0?\.\d+|t\s*检验|F\s*检验|AIC|BIC|显著性|置信区间|[Rr][²2]|残差/g)||[]).length;
  S.D2=Math.min(0.40,0.28+0.03*Math.min(stC,4));

  var coC=(text.match(/(?:本文|本模型).*(?:优于|高于|好于).*(?:传统|原有|基准)/g)||[]).length+(text.match(/相比.*(?:提升|提高|降低|减少).*\d/g)||[]).length;
  S.D3=Math.min(0.40,0.26+0.05*Math.min(coC,3));

  var evT=st.evaluation;
  var aM=evT.match(/优点[：:\s]*([\s\S]*?)(?:缺点|不足|局限|$)/);
  var dM=evT.match(/(?:缺点|不足|局限)[：:\s]*([\s\S]*?)(?:推广|改进|展望|参考|$)/);
  var aL=aM?aM[1].replace(/\s/g,'').length:0;
  var dL=dM?dM[1].replace(/\s/g,'').length:0;
  var hasBoth=aL>10&&dL>8;
  S.D4=0.30+0.06*hasBoth+0.04*(/推广|改进|展望/.test(evT));
  if(S.D4<0.34) F.D4='模型评价需要实质性优缺点分析';

  // ===== E. 规范 (1.50) — 基线: ~80% = 1.20 =====
  var tF=st.figureRefs,aF=(text.match(/图\s*\d+\s*(?:显示|表明|展示|反映|说明|可以|从中|看出|可见|呈现)/g)||[]).length;
  // Also count implicit figure analysis (paragraphs near figure references)
  var implicitAnalysis = (text.match(/图\s*\d+[\s\S]{0,30}(?:可以|说明|反映|显示|表明|看出)/g)||[]).length;
  aF = Math.max(aF, implicitAnalysis);
  S.E1=Math.min(0.50,0.36+0.14*Math.min(tF>0?aF/Math.max(tF,1):0.5,1));

  var weR=(text.match(/我们|我[^国们]|本组/g)||[]).length/Math.max(1,text.length)*1000;
  S.E2=Math.max(0.30,0.40-0.03*Math.min(weR,3));

  var rC=new Set(text.match(/\[\d+\]/g)||[]).size;
  var eR=(text.substring(Math.max(0,text.length-5000)).match(/[A-Z][a-z]{3,}.*\d{4}/g)||[]).length;
  S.E3=Math.min(0.30,0.20+0.05*Math.min(rC/8,1)+0.05*Math.min(eR/2,1));

  S.E4=/\(\d+[-\d]*\)\s*$/.test(text)?0.28:0.22;

  // ===== ASSEMBLE =====
  var r={fname:fname,pages:pages,chars:text.length,scores:S,fb:F,found:fndM,missing:misM,_ab:ab,_an:pa,_es:evT,stats:st};
  recalcDimsV2(r);
  return r;
}

function recalcDimsV2(r){
  var mv={A1:0.45,A2:0.38,A3:0.22,A4:0.22,A5:0.22,B1:0.40,B2:0.60,B3:0.50,B4:0.50,B5:0.50,C1:0.60,C2:0.40,C3:0.60,C4:0.50,C5:0.40,D1:0.80,D2:0.40,D3:0.40,D4:0.40,E1:0.50,E2:0.40,E3:0.30,E4:0.30};
  var mp={假设:['B1','B2','B3','B4','B5'],建模:['C1','C2','C3','C4','C5'],结果:['D1','D2','D3','D4'],表述:['A1','A2','A3','A4','A5','E1','E2','E3','E4']};
  r.dims={};r.dl={假设:'假设的合理性',建模:'建模的创造性',结果:'结果的正确性',表述:'文字表述的清晰性'};r.mv=mv;
  for(var d in mp){var g=0,m=0;mp[d].forEach(function(k){g+=r.scores[k]||0;m+=mv[k]||0;});r.dims[d]=m>0?+(g/m*10).toFixed(1):0;}
  r.total=+(0.20*r.dims['假设']+0.35*r.dims['建模']+0.30*r.dims['结果']+0.15*r.dims['表述']).toFixed(2);
  r.t23=+Object.values(r.scores).reduce(function(a,b){return a+b;},0).toFixed(2);
  r.award=r.total>=8.5?'稳国一':r.total>=7.5?'国一竞争力':r.total>=6.5?'国二':r.total>=5.5?'省一':r.total>=4.5?'省二~省三':'需大幅改进';
}

function gatherStats(text){
  var ab=extractSection(text,['摘 要','摘  要','摘要'],['关键词','关键字','一、','1.']);
  return {
    abstract:ab,
    abstract_chars:(ab||'').replace(/摘要|摘\s*要|关键词|关键字|[\s\n]+/g,'').length,
    problemAnalysis:extractSection(text,['问题分析','二、问题分析'],['模型假设','三、'])||'',
    assumptions:extractSection(text,['模型假设','基本假设','三、模型假设','三、 模型假设'],['符号说明','四、'])||'',
    preprocessing:extractSection(text,['数据预处理','数据清洗','数据处理','数据侧写'],['模型建立','模型构建','五、'])||'',
    evaluation:extractSection(text,['模型评价','模型的评价','模型的分析与评价','优缺点分析','六、模型的','六、 模型的'],['参考文献','附录','七、'])||'',
    figureRefs:(text.match(/图\s*\d+|如图|Fig/g)||[]).length,
  };
}

function extractSection(text,starts,ends){
  for(var i=0;i<starts.length;i++){var idx=text.indexOf(starts[i]);if(idx===-1)continue;var end=idx+3000;for(var j=0;j<ends.length;j++){var ei=text.indexOf(ends[j],idx+starts[i].length);if(ei!==-1&&ei<end)end=ei;}return text.substring(idx,Math.min(end,text.length));}return '';
}
