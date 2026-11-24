import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {JournalMethod} from './JournalMethod';
import {JournalHeading} from './JournalHeading';
it('decorates only existing step prefixes and preserves original instruction characters and blank lines',()=>{
 const text='1. Mix <milk>.\n\nKeep this line.\n2) Bake & serve.';
 const html=renderToStaticMarkup(createElement(JournalMethod,{text}));
 expect(html.match(/class="journal-step-number"/g)).toHaveLength(2);
 expect(html.replace(/<[^>]+>/g,'')).toBe('1. Mix &lt;milk&gt;.\n\nKeep this line.\n2) Bake &amp; serve.');
});
it('does not invent steps or change unnumbered Chinese instructions',()=>{
 const text='轻轻拌匀。\n冷藏后享用。',html=renderToStaticMarkup(createElement(JournalMethod,{text}));
 expect(html).not.toContain('journal-step-number');expect(html.replace(/<[^>]+>/g,'')).toBe(text);
});
it('keeps heading content inline and safely escapes user-authored titles',()=>{
 const html=renderToStaticMarkup(createElement(JournalHeading,{children:'Pastry <酱汁>'}));expect(html).toBe('<span class="journal-heading">Pastry &lt;酱汁&gt;</span>');
});
