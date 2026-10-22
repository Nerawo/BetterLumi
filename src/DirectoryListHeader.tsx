import type {ReactNode} from 'react';
export function DirectoryListHeader({count,children}:{count:string;children?:ReactNode}){
 return <div className="directory-list-heading directory-summary-row"><span className="muted">{count}</span>{children}</div>;
}
