import type {ReactNode} from 'react';

export function PantryRowContent({title,titleDescription,energy,metadata,macros,actions}:{title:ReactNode;titleDescription?:string;energy:ReactNode;metadata?:ReactNode;macros?:ReactNode;actions?:ReactNode}){
 return <div className={'grow pantry-row-content'+(actions?' has-secondary-actions':'')}><div className="ingredient-title-line"><h3 title={titleDescription}>{title}</h3><span className="ingredient-energy">{energy}</span></div>{(metadata || actions) && <div className="pantry-secondary-line"><div className="pantry-source-line">{metadata}</div>{actions}</div>}{macros && <p className="macro-summary">{macros}</p>}</div>;
}
