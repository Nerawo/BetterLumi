import {useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {Info} from 'lucide-react';
import {Modal} from './ui';
import {bologneseSourceUrl} from './data/builtInRecipes';
import './reference-locale';
import './reference-library.css';
export function BuiltInRecipeSource(){
 const {t,i18n}=useTranslation(),zh=i18n.language.startsWith('zh'),[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}))};
 return <span className="reference-origin"><span>{t('referenceBuiltIn')}</span><button type="button" className="reference-info-trigger" ref={trigger} aria-label={t('referenceSource')} aria-haspopup="dialog" aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(true)}}><Info size={14}/></button>{open&&createPortal(<Modal title={t('referenceSource')} close={close} className="reference-source-modal"><div className="reference-source-content">
 <h3>{zh?'食谱来源':'Recipe source'}</h3><strong>Accademia Italiana della Cucina</strong>
 <p>{zh?'肉酱参考 2023 年 4 月 20 日登记的六人份传统配方。每份 80g 干宽面是 BetterLumi 的搭配选择，不是登记配方的一部分。':'The ragù follows the six-person recipe registered on 20 April 2023. The 80 g dry pasta per serving is BetterLumi’s choice, outside the registered ragù formula.'}</p>
 <a href={bologneseSourceUrl} target="_blank" rel="noreferrer">{zh?'查看意大利烹饪学院来源 ↗':'View Academy source ↗'}</a>
 <h3>{zh?'营养来源':'Nutrition source'}</h3><strong>USDA FoodData Central</strong>
 <p>{zh?'按原料用量计算；通用干意大利面对应宽面，生五花肉对应鲜 pancetta，无盐番茄泥对应 passata，通用番茄膏对应双倍浓缩番茄膏，通用橄榄油对应特级初榨，红餐酒对应干红。牛肉采用生的 85% 瘦肉参考。':'Ingredient-based estimates use generic dry pasta for tagliatelle, raw pork belly for fresh pancetta, unsalted purée for passata, generic paste for double concentrate, generic olive oil for extra virgin, red table wine for dry red, and raw 85%-lean ground beef.'}</p>
 <p>{zh?'原文酒和牛奶各为一杯；本版本采用半杯红酒和半杯牛奶（原文牛奶可选）。番茄膏 16g、橄榄油 40.5g、红酒 117.6g、牛奶 124.5g 均按 USDA 份量换算。':'The original specifies a glass each of wine and optional milk; this version uses ½ cup of each and includes milk. USDA portion conversions: paste 16 g, oil 40.5 g, wine 117.6 g, milk 124.5 g.'}</p>
 <p>{zh?'未扣除烹调中的酒精、油脂或水分损失；按需高汤及适量调味料未计入。品牌、肉类部位、烹调损耗、高汤用量和分餐方式均会影响实际营养。':'No alcohol, fat or moisture cooking-loss adjustment is made. Unmeasured broth and seasonings are excluded. Brands, meat cuts, cooking losses, broth quantity and serving size affect actual nutrition.'}</p>
 <a href="https://fdc.nal.usda.gov/food-search" target="_blank" rel="noreferrer">{t('referenceFoodSourceLink')}</a>
 </div><div className="form-actions"><button type="button" onClick={close}>{t('close')}</button></div></Modal>,document.body)}</span>;
}
