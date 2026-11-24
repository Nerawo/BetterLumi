/** Decorate only existing step prefixes; preserve every character and newline. */
export function JournalMethod({text}:{text:string}){
 return <div className="journal-method preserved-text">{text.split(/(\r?\n)/).map((line,i)=>{
  const step=line.match(/^(\s*)(\d+[.)、．]\s*)/);
  return step?<span key={i}>{step[1]}<span className="journal-step-number">{step[2]}</span>{line.slice(step[0].length)}</span>:line;
 })}</div>;
}
