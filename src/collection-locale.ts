import i18n from './locale';
const en={collectionMoveUp:'Move {{name}} up',collectionMoveDown:'Move {{name}} down',collectionDrag:'Drag to reorder; use arrow buttons on touch screens'};
const zh:Record<keyof typeof en,string>={collectionMoveUp:'上移 {{name}}',collectionMoveDown:'下移 {{name}}',collectionDrag:'拖动排序；触屏可使用上下移动按钮'};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
