import type {ReactNode} from 'react';
/** Inline-only highlight; shared by journal section and group headings. */
export function JournalHeading({children}:{children:ReactNode}){
 return <span className="journal-heading">{children}</span>;
}
