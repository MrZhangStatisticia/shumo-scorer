// ============================================================
// 数学建模论文评分引擎 v2.3 — 多模式加权规则
// 纯浏览器运行，零外部依赖
// ============================================================

function scoreV2(text, pages, fname) {
  var S = {}; // scores
  var F = {}; // feedback
  var stats = gatherStats(text);
  var ab = stats.abstract;
  var ap = ab || text.substring(0, 3000);

  // ========== A. 摘要质量 (1.50) ==========

  // A1: 问题→方法→结果链条 (0.45)
  // 检测三种模式：问题引导句、方法陈述句、结果呈现句
  var qPatterns = [/问题[一二三四]/g, /问题[1-4]/g, /分析.*分布/g, /分析.*关系/g, /制定.*策略/g, /确定.*方案/g];
  var mPatterns = [/建立.*模型/g, /构建.*模型/g, /采用.*方法/g, /利用.*算法/g, /通过.*分析/g, /引入.*模型/g];
  var rPatterns = [/(?:得到|求得|求解|结果为|计算得|发现|表明).*[0-9]/g, /[=＝]\s*\d+\.?\d*/g, /约?\d+\.?\d*\s*(?:千[克]|元|种|%|万)/g];
  var qc = 0, mc = 0, rc = 0;
  qPatterns.forEach(function(p){ var m=ap.match(p); if(m) qc+=m.length; });
  mPatterns.forEach(function(p){ var m=ap.match(p); if(m) mc+=m.length; });
  rPatterns.forEach(function(p){ var m=ap.match(p); if(m) rc+=m.length; });

  S.A1 = Math.min(0.45, 0.30 + 0.05*Math.min(qc,3) + 0.05*Math.min(mc,3) + 0.05*Math.min(rc,2));
  if(S.A1 < 0.35) F.A1 = '摘要缺少问题→方法→结果的完整叙述链，建议每个问题都包含"针对X→采用Y→得到Z"的结构';

  // A2: 数值密度 (0.38) — 多类型数值加权
  var numTypes = {
    stats: (ap.match(/[Rr][²2]\s*[=＝]\s*0?\.\d+|准确[率度]\s*\d+\.?\d*%|p\s*[<≤]\s*0?\.\d+|AIC\s*[=＝]\s*\d+|F\s*[=＝]\s*\d+/g)||[]).length,
    money: (ap.match(/[=＝约达为]\s*\d+\.?\d*\s*(?:元|万)/g)||[]).length,
    quantity: (ap.match(/[=＝约达为]\s*\d+\.?\d*\s*(?:千[克]|种|个|%|倍)/g)||[]).length,
    plain: (ap.match(/[=＝]\s*\d+\.?\d*/g)||[]).length,
  };
  var numScore = numTypes.stats*0.12 + numTypes.money*0.08 + numTypes.quantity*0.06 + Math.min(numTypes.plain*0.04, 0.12);
  S.A2 = Math.min(0.38, Math.max(0.08, numScore));
  if(S.A2 < 0.25) F.A2 = '摘要数值密度偏低('+Object.values(numTypes).reduce(function(a,b){return a+b;},0)+'个)，国一标准每个问题后应紧跟具体数值';

  // A3: 改写原创度 (0.22)
  var origWords = ['附件1','附件2','附件3','附件4','根据附件','题目给出','提供.*数据','现有一批'];
  var origCount = 0;
  origWords.forEach(function(w){ if(new RegExp(w).test(ap)) origCount++; });
  // Also check for background context keywords (good sign)
  var bgWords = ['随着','近年来','我国','市场','行业','经济','社会','消费者','企业面临'];
  var bgCount = 0;
  bgWords.forEach(function(w){ if(new RegExp(w).test(ap)) bgCount++; });
  S.A3 = Math.min(0.22, 0.14 + 0.04*bgCount - 0.04*origCount);
  S.A3 = Math.max(0.08, S.A3);

  // A4: 创新点可见度 (0.22)
  var innoPatterns = [
    /构建了.*模型.*体系/g, /提出.*方法/g, /设计了.*框架/g,
    /(?:创新|特色|亮点).*(?:在于|是|体现)/g, /本文.*(?:创新|特色|贡献)/g,
    /从.*和.*(?:两个|三个|多).*维度/g, /(?:融合|结合|混合).*(?:模型|方法|算法)/g,
  ];
  var innoCount = 0;
  innoPatterns.forEach(function(p){ var m=ap.match(p); if(m) innoCount+=m.length; });
  S.A4 = Math.min(0.22, 0.06 + 0.04*Math.min(innoCount,4));
  if(S.A4 < 0.12 && stats.abstract_chars > 200) F.A4 = '摘要末段建议概括2-3个创新点或模型特色';

  // A5: 篇幅 (0.22)
  var al = stats.abstract_chars;
  S.A5 = (al > 200 && al < 600) ? 0.22 : (al >= 100 && al < 900) ? 0.16 : (al > 0 && al < 1200) ? 0.10 : 0.06;

  // ========== B. 逻辑结构 (2.50) ==========

  // B1: 模块完整性 (0.40)
  var reqModules = ['问题重述','问题分析','模型假设','符号说明','模型建立','模型求解','模型检验','模型评价','参考文献','附录'];
  var foundMods = [], missMods = [];
  reqModules.forEach(function(m){
    if(text.indexOf(m) !== -1) foundMods.push(m); else missMods.push(m);
  });
  S.B1 = 0.40 * foundMods.length / reqModules.length;
  if(missMods.length >= 2) F.B1 = '缺少模块: '+missMods.join('、');

  // B2: 问题分析深度 (0.60) — 因果推理 + 结构层次
  var pa = stats.problemAnalysis;
  var causalPatterns = [
    /由于.*(?:因此|所以|故)/g, /因为.*(?:选择|采用|建立)/g,
    /考虑到.*(?:特征|特点|约束|限制)/g, /鉴于.*(?:本文|我们|本组)/g,
    /数据.*(?:呈现|表现|具有).*(?:特征|规律|趋势|特点).*(?:因此|故|所以|选择)/g,
    /(?:问题|本问).*(?:本质|核心|关键).*(?:是|在于)/g,
  ];
  var causalScore = 0;
  causalPatterns.forEach(function(p){ var m=pa.match(p); if(m) causalScore += m.length; });
  var hasFlowchart = /(?:思路|流程|框架|技术路线).*(?:图|如图|见图)/.test(pa);
  var hasMultiDim = /从.*(?:两个|三个|多个|以下).*(?:角度|方面|维度|部分)/.test(pa);
  var hasMethodJustify = /(?:本质|核心|关键).*(?:是|在于).*(?:问题|因此|所以)/.test(pa);
  S.B2 = Math.min(0.60, 0.32 + 0.06*Math.min(causalScore,3) + 0.08*hasFlowchart + 0.07*hasMultiDim + 0.07*hasMethodJustify);
  if(S.B2 < 0.44) F.B2 = '问题分析建议加强因果推理(因为数据X特征→所以选择Y方法)，并配一张思路流程图';

  // B3: 过渡衔接 (0.50)
  var transPatterns = [
    /基于(?:上述|以上|问题.).*(?:分析|结果|结论)/g, /在上述.*基础上/g,
    /(?:为此|为此目的|因此|故而)/g, /进一步.*(?:分析|探索|研究|考虑)/g,
    /(?:问题.|问题.).*(?:揭示|表明|发现).*(?:问题.|问题.)/g,
    /(?:综上|综上所述|综合.*分析)/g,
  ];
  var transScore = 0;
  transPatterns.forEach(function(p){ var m=text.match(p); if(m) transScore += m.length; });
  S.B3 = Math.min(0.50, 0.28 + 0.04*Math.min(transScore,5));

  // B4: 假设论证质量 (0.50)
  var asText = stats.assumptions;
  var asCount = (asText.match(/\n\s*\d+[\.\、\)）]/g)||[]).length;
  // Measure explanation length after each assumption
  var asItems = asText.split(/\n\s*\d+[\.\、\)）]/).filter(function(s){return s.trim().length>0;});
  var wellExplained = 0;
  asItems.forEach(function(item){ if(item.length > 30) wellExplained++; });
  var explanationRatio = asCount > 0 ? wellExplained/asCount : 0;
  S.B4 = Math.min(0.50, 0.25 + 0.15*Math.min(asCount/5,1) + 0.10*explanationRatio);
  if(asCount < 2) F.B4 = '模型假设仅有'+asCount+'条，建议增加到4-6条并每条跟一句解释说明';

  // B5: 层次递进 (0.50)
  var layerPatterns = [
    /问题.*(?:结论|结果|分析).*(?:为|给).*问题.*(?:提供|奠定|支持)/g,
    /基于.*模型.*(?:进一步|扩展|推广).*(?:建立|构建|提出)/g,
    /将.*(?:模型|方法|结果).*(?:应用于|扩展到|推广至)/g,
  ];
  var layerScore = 0;
  layerPatterns.forEach(function(p){ var m=text.match(p); if(m) layerScore+=m.length; });
  S.B5 = Math.min(0.50, 0.28 + 0.06*Math.min(layerScore,3) + 0.04*hasFlowchart);
  if(S.B5 < 0.32) F.B5 = '建议画一张总体流程图，标注各模型间的输入输出和递进关系';

  // ========== C. 数学叙事 (2.50) ==========

  // C1: 公式-文字交替率 (0.60) — 检测连续公式堆砌
  var lines = text.split('\n').map(function(l){return l.trim();}).filter(function(l){return l;});
  var formulaBlocks = [];
  var currentBlock = 0;
  for(var i=0; i<lines.length; i++){
    var hasFormula = /[=＝∑∏∫∂√∞αβγδεθλμπσφω]|\\frac|\\sum|\\int|\\mathbf|\\boldsymbol/.test(lines[i]);
    var isShort = lines[i].length < 6;
    if(hasFormula) currentBlock++; else { if(currentBlock>0){ formulaBlocks.push(currentBlock); currentBlock=0; } }
  }
  if(currentBlock>0) formulaBlocks.push(currentBlock);
  var maxStack = formulaBlocks.length>0 ? Math.max.apply(null,formulaBlocks) : 0;
  var avgStack = formulaBlocks.length>0 ? formulaBlocks.reduce(function(a,b){return a+b;},0)/formulaBlocks.length : 0;
  S.C1 = maxStack >= 5 ? 0.35 : (maxStack >= 3 ? 0.45 : (avgStack > 2 ? 0.50 : 0.55));
  if(maxStack >= 3) F.C1 = '检测到连续'+maxStack+'个公式堆砌，建议每1-2个公式间插入一句解释文字';

  // C2: 符号规范 (0.40)
  var hasSymbolTable = /符号说明/.test(text);
  var hasUnits = /(?:单位|kg|千[克]|元|万|m³|%|小?时|周|年|分)/.test(text.substring(0,2000));
  S.C2 = 0.28 + 0.06*hasSymbolTable + 0.06*hasUnits;

  // C3: 模型选择依据 (0.60) — 扩展因果检测
  var modelJustifyPatterns = [
    /由于.*(?:数据|问题|约束).*(?:采用|选择|建立|使用)/g,
    /(?:鉴于|考虑到).*(?:特点|特征|属性|性质).*(?:因此|采用|选择)/g,
    /(?:数据|结果|检验).*(?:呈现|表明|显示).*(?:非正态|非线性|非平稳|相关).*(?:因此|故|所以|选择)/g,
    /传统.*(?:方法|模型).*(?:难以|无法|不能).*(?:因此|本文|故|所以)/g,
    /(?:问题|本问).*(?:实质|本质).*(?:是|为).*(?:分类|回归|优化|预测|评价|聚类)/g,
  ];
  var justifyScore = 0;
  modelJustifyPatterns.forEach(function(p){ var m=text.match(p); if(m) justifyScore+=m.length; });
  S.C3 = Math.min(0.60, 0.30 + 0.06*Math.min(justifyScore,5));
  if(S.C3 < 0.40) F.C3 = '模型选择需要更明确的因果依据，建议每次引入模型前解释"因为数据/问题的X特征，所以选择Y方法"';

  // C4: 数据预处理叙事 (0.50)
  var prepText = stats.preprocessing;
  var prepSteps = (prepText.match(/(?:缺失|异常|重复|清洗|处理|剔除|筛选|标准化|归一化)/g)||[]).length;
  var prepNarrative = /(?:发现|检测到|观察|注意到).*(?:问题|异常|缺失|错误)/.test(prepText) &&
                      /(?:因此|故|于是|选择).*(?:处理|清洗|剔除|修正|填充)/.test(prepText);
  S.C4 = Math.min(0.50, 0.28 + 0.05*Math.min(prepSteps,3) + 0.07*prepNarrative);
  if(S.C4 < 0.35) F.C4 = '数据预处理建议改为叙事式：发现了X问题→制定了Y规则→验证了Z效果';

  // C5: 模型命名辨识度 (0.40)
  var modelNamePatterns = [
    /\w{2,}(?:模型|算法|方法|网络|框架|体系|策略)/g,
    /(?:三层|多层|双层|递进|混合|融合|集成).*(?:模型|框架|体系)/g,
    /\w+-\w+(?:模型|框架|体系)/g,
  ];
  var uniqueNames = new Set();
  modelNamePatterns.forEach(function(p){
    var m=text.match(p); if(m) m.forEach(function(n){ uniqueNames.add(n); });
  });
  S.C5 = Math.min(0.40, 0.24 + 0.04*Math.min(uniqueNames.size,4));

  // ========== D. 结果可信度 (2.00) ==========

  // D1: 模型验证 (0.80)
  var sensPatterns = [/灵敏度/g, /敏感性/g, /鲁棒性/g, /扰动/g, /稳健性/g, /变动率/g, /变化率/g];
  var sensCount = 0;
  sensPatterns.forEach(function(p){ var m=text.match(p); if(m) sensCount+=m.length; });
  var hasSensSection = sensCount >= 2;
  var hasSensQuantitative = /(?:变动率|变化率|扰动.*[%％]|±\s*\d+)/.test(text);
  var hasValidation = /(?:验证|检验|测试|校验|诊断).*(?:模型|结果|拟合|误差)/.test(text.substring(Math.max(0,text.length-6000)));
  var hasCrossValidation = /(?:对比|比较|相比).*(?:传统|原有|基准|baseline|改进前)/.test(text);

  if(hasSensSection && hasSensQuantitative) S.D1 = 0.72;
  else if(hasSensSection) S.D1 = 0.50;
  else if(hasValidation && hasCrossValidation) S.D1 = 0.40;
  else if(hasValidation) S.D1 = 0.30;
  else S.D1 = 0.12;

  if(S.D1 < 0.45) F.D1 = '缺少模型验证环节。建议加入灵敏度分析(参数±10%扰动)或多模型对比验证，这是省奖→国奖的关键跳板';

  // D2: 统计检验 (0.40)
  var statPatterns = [/p\s*[<≤=]\s*0?\.\d+/g, /t\s*[检验检测]/g, /F\s*[检验检测值]/g, /AIC/g, /BIC/g, /显著性/g, /置信区间/g, /[Rr][²2]/g, /残差/g];
  var statCount = 0;
  statPatterns.forEach(function(p){ var m=text.match(p); if(m) statCount+=m.length; });
  S.D2 = Math.min(0.40, 0.22 + 0.03*Math.min(statCount,6));

  // D3: 多方法对比 (0.40)
  var comparePatterns = [
    /(?:本文|本模型|本方法).*(?:优于|高于|好于|胜过).*(?:传统|原有|基准|基础)/g,
    /相比.*(?:传统|原有|原|基础|一般).*(?:方法|模型|做法).*(?:提升|提高|降低|减少|改进)[了\d]/g,
    /(?:与|和).*(?:传统|一般|常规).*(?:对比|比较|相比)/g,
  ];
  var compScore = 0;
  comparePatterns.forEach(function(p){ var m=text.match(p); if(m) compScore+=m.length; });
  S.D3 = Math.min(0.40, 0.20 + 0.07*Math.min(compScore,3));

  // D4: 模型评价平衡性 (0.40)
  var evalText = stats.evaluation;
  var advLen = 0, disadvLen = 0;
  var advMatch = evalText.match(/优点[：:\s]*([\s\S]*?)(?:缺点|不足|局限|$)/);
  if(advMatch) advLen = advMatch[1].replace(/\s/g,'').length;
  var disMatch = evalText.match(/(?:缺点|不足|局限)[：:\s]*([\s\S]*?)(?:推广|改进|展望|参考|$)/);
  if(disMatch) disadvLen = disMatch[1].replace(/\s/g,'').length;
  var hasBoth = advLen > 20 && disadvLen > 15;
  var isBalanced = hasBoth && Math.abs(advLen-disadvLen)/Math.max(advLen,disadvLen) < 0.7;
  var hasPromotion = /(?:推广|改进|展望|优化方向|未来)/.test(evalText);
  S.D4 = 0.22 + 0.08*hasBoth + 0.05*isBalanced + 0.05*hasPromotion;
  if(S.D4 < 0.30) F.D4 = '模型评价需要包含实质性优缺点分析(各>15字)和改进推广方向';

  // ========== E. 表达规范 (1.50) ==========

  // E1: 图表解析 (0.50)
  var totalFigs = stats.figureRefs;
  var analyzedFigs = (text.match(/图\s*\d+\s*(?:显示|表明|展示|反映|说明|可以|从中|看出|可见|呈现|表现|表示)/g)||[]).length;
  var analysisRatio = totalFigs > 0 ? analyzedFigs/totalFigs : 0;
  S.E1 = Math.min(0.50, 0.30 + 0.20*analysisRatio);
  if(totalFigs >= 5 && analysisRatio < 0.4) F.E1 = totalFigs+'处图表中仅'+analyzedFigs+'处有解析，每张图需配3句以上分析';

  // E2: 语言规范性 (0.40)
  var weCount = (text.match(/我们|我[^国们]|本组/g)||[]).length;
  var weRatio = weCount / Math.max(1, text.length) * 1000; // per 1000 chars
  var hasOral = /(?:很|非常|特别|超级).*(?:好|棒|厉害|优秀)/.test(text);
  var typoDensity = (text.match(/[的地得]混淆|错别字/g)||[]).length; // rough estimate
  S.E2 = 0.40 - 0.03*Math.min(weRatio,3) - 0.05*hasOral;
  S.E2 = Math.max(0.22, S.E2);
  if(weRatio > 2.5) F.E2 = '第一人称使用频率偏高，可适当替换为"本文/结果表明/分析发现"';

  // E3: 参考文献 (0.30)
  var refNums = new Set(text.match(/\[\d+\]/g)||[]);
  var refCount = refNums.size;
  var engRefs = (text.substring(Math.max(0,text.length-5000)).match(/[A-Z][a-z]{3,}.*\d{4}/g)||[]).length;
  var hasRefCite = /\[\d+\]/.test(text.substring(0, Math.floor(text.length*0.8)));
  S.E3 = Math.min(0.30, 0.16 + 0.06*Math.min(refCount/8,1) + 0.04*Math.min(engRefs/2,1) + 0.04*hasRefCite);

  // E4: 排版 (0.30)
  var hasFormulaNum = /\(\d+[-\d]*\)\s*$/.test(text);
  var hasNumberedSections = /(?:一、|二、|三、|四、|五、|六、)/.test(text);
  S.E4 = 0.20 + 0.05*hasFormulaNum + 0.05*hasNumberedSections;

  // ========== ASSEMBLE ==========
  var r = {
    fname: fname, pages: pages, chars: text.length,
    scores: S, fb: F,
    found: foundMods, missing: missMods,
    _ab: ab, _an: pa, _es: evalText,
    stats: stats,
  };
  recalcDimsV2(r);
  return r;
}

function recalcDimsV2(r) {
  var mv = {A1:0.45,A2:0.38,A3:0.22,A4:0.22,A5:0.22,B1:0.40,B2:0.60,B3:0.50,B4:0.50,B5:0.50,C1:0.60,C2:0.40,C3:0.60,C4:0.50,C5:0.40,D1:0.80,D2:0.40,D3:0.40,D4:0.40,E1:0.50,E2:0.40,E3:0.30,E4:0.30};
  var mp = {'假设':['B1','B2','B3','B4','B5'],'建模':['C1','C2','C3','C4','C5'],'结果':['D1','D2','D3','D4'],'表述':['A1','A2','A3','A4','A5','E1','E2','E3','E4']};
  r.dims = {}; r.dl = {'假设':'假设的合理性','建模':'建模的创造性','结果':'结果的正确性','表述':'文字表述的清晰性'}; r.mv = mv;
  for(var d in mp){ var g=0,m=0; mp[d].forEach(function(k){ g+=r.scores[k]||0; m+=mv[k]||0; }); r.dims[d]=m>0?+(g/m*10).toFixed(1):0; }
  r.total = +(0.20*r.dims['假设']+0.35*r.dims['建模']+0.30*r.dims['结果']+0.15*r.dims['表述']).toFixed(2);
  r.t23 = +Object.values(r.scores).reduce(function(a,b){return a+b;},0).toFixed(2);
  r.award = r.total>=9?'稳国一':r.total>=8?'国一竞争力':r.total>=7?'国二':r.total>=6?'省一':r.total>=5?'省二~省三':'需大幅改进';
}

function gatherStats(text) {
  var ab = extractSection(text, ['摘 要','摘  要','摘要'], ['关键词','关键字','一、','1.']);
  return {
    abstract: ab,
    abstract_chars: (ab||'').replace(/摘要|摘\s*要|关键词|关键字|[\s\n]+/g,'').length,
    problemAnalysis: extractSection(text, ['问题分析','二、问题分析'], ['模型假设','三、'])||'',
    assumptions: extractSection(text, ['模型假设','基本假设','三、模型假设','三、 模型假设'], ['符号说明','四、'])||'',
    preprocessing: extractSection(text, ['数据预处理','数据清洗','数据处理','数据侧写'], ['模型建立','模型构建','五、'])||'',
    evaluation: extractSection(text, ['模型评价','模型的评价','模型的分析与评价','优缺点分析','六、模型的','六、 模型的'], ['参考文献','附录','七、'])||'',
    figureRefs: (text.match(/图\s*\d+|如图|Fig/g)||[]).length,
  };
}

function extractSection(text, starts, ends) {
  for(var i=0; i<starts.length; i++){
    var idx=text.indexOf(starts[i]); if(idx===-1) continue;
    var end=idx+3000;
    for(var j=0; j<ends.length; j++){
      var ei=text.indexOf(ends[j], idx+starts[i].length);
      if(ei!==-1 && ei<end) end=ei;
    }
    return text.substring(idx, Math.min(end, text.length));
  }
  return '';
}
