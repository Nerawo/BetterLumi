import i18n from "./locale";
const en = {
  allCategories: "All",
  manageCategories: "Manage categories",
  categoryName: "Category name",
  createCategory: "Create category",
  categoryError: "Use a unique, non-empty category name.",
  categoryHint: "Create categories from Manage categories in the Recipes list.",
  legacyCategory: "Previous label",
  deleteCategoryConfirm: "Delete this category? Recipes will be kept.",
  writeNote: "＋ Write a sticky note",
  noteMenu: "Note options",
  themeTitle: "Theme",
  oliveTheme: "Olive · selected",
  palettePending: "Palette not defined",
  themePendingHelp:
    "These four swatches belong to the current Olive palette. Only Olive has a complete theme definition; three additional palettes await design.",
  calendarHistory: "Calendar & history",
};
const zh = {
  allCategories: "全部",
  manageCategories: "管理分类",
  categoryName: "分类名称",
  createCategory: "创建分类",
  categoryError: "请填写不重复的分类名称。",
  categoryHint: "在食谱列表的“管理分类”中创建分类。",
  legacyCategory: "原有标签",
  deleteCategoryConfirm: "删除此分类？食谱会保留。",
  writeNote: "＋ 写张便利贴",
  noteMenu: "便利贴选项",
  themeTitle: "主题",
  oliveTheme: "Olive · 已选择",
  palettePending: "主题配色待定义",
  themePendingHelp:
    "这四个色块属于当前 Olive 配色。目前只有 Olive 有完整主题定义，另外三套配色等待后续设计。",
  calendarHistory: "日历与历史",
};
i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("zh", "translation", zh, true, true);
