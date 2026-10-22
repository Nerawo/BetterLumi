import {JournalMasthead} from "./JournalMasthead";
import {useTranslation} from "react-i18next";
export function TodayHeader({date,onLanguageSwitch}:{date:string;onLanguageSwitch:()=>void}){
 const {t,i18n}=useTranslation();
 return (<header className="graphic-introduction">
        <JournalMasthead onLanguageSwitch={onLanguageSwitch}/>
        <div className="graphic-date"><time dateTime={date}>{new Date(date + "T12:00:00").toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US", {month: "short", day: "numeric", weekday: "short"})}</time><span>{date.slice(0,4)} / {t("graphicJournal")}</span></div>
        <div className="graphic-cover-composition">
          {/* Intentional English brand statement in every app language. */}
          <h1 className="graphic-headline" lang="en" aria-label="A BRIGHTER YOU TODAY"><span>A</span><span>BRIGHTER</span><span>YOU</span><em>TODAY</em></h1>
          <svg className="graphic-cover-art" viewBox="0 0 160 280" aria-hidden="true"><path className="graphic-art-rule" d="M30 0V280"/><ellipse className="graphic-art-gold" cx="151" cy="73" rx="91" ry="73"/><path className="graphic-art-forest" d="M160 115C85 121 110 197 27 226L27 280H160Z"/><circle className="graphic-art-peach" cx="144" cy="282" r="56"/><path className="graphic-art-rule" d="M0 242H160"/></svg>
        </div>
      </header>);
}
