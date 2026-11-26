import i18n from './locale';
const en={collectionMoveUp:'Move {{name}} up',collectionMoveDown:'Move {{name}} down',collectionDrag:'Drag to reorder, or use the arrow keys'};
const zh:Record<keyof typeof en,string>={collectionMoveUp:'上移 {{name}}',collectionMoveDown:'下移 {{name}}',collectionDrag:'拖动排序，或使用键盘方向键'};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
