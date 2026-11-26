import {useId, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {ChevronDown, ChevronRight, Plus} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {validConsumptionUnit, type ConsumptionUnit} from './consumption-units';
import {confirmDelete} from './DeleteConfirmation';
import {DraftUnitPicker} from './DraftUnitPicker';
import {JournalHeading} from './JournalHeading';
import {JournalQuantityInput} from './JournalQuantityInput';
import {JournalTextField} from './JournalTextField';

export type UnitDraft = {
  id: number;
  name: string;
  quantity: number | null;
  amount: number | null;
  unit: 'g' | 'mL' | null;
};
type BaseUnit = 'g' | 'mL';

export function asConversion(row: UnitDraft, base: BaseUnit): ConsumptionUnit {
  return {name: row.name.trim(), quantity: row.quantity ?? NaN, amount: row.amount ?? NaN, unit: row.unit ?? base};
}

const formatAmount = (value: number) => String(Number(value.toPrecision(15)));

function CustomUnitEditor({id, row, base, update, remove}: {
  id: string;
  row: UnitDraft;
  base: BaseUnit;
  update: (patch: Partial<Omit<UnitDraft,'id'>>) => void;
  remove: () => void;
}) {
  const {t} = useTranslation();
  const unit = row.unit ?? base;

  return <div className="journal-conversion" id={id}>
    <JournalTextField name="conversionName" label={t('name')} value={row.name}
      onChange={name => update({name})} placeholder={t('unitNamePlaceholder')} maxLength={40} showPencil={false} />
    <div className="serving-unit-relation" role="group" aria-labelledby={id+'-relation'}>
      <div className="ingredient-field-label" id={id+'-relation'}>{t('unitConversionRelation')}</div>
      <div className="serving-unit-equation">
        <JournalQuantityInput name="conversionQuantity" label={t('unitCustomQuantity')}
          quantity={row.quantity} format={formatAmount}
          onClear={() => update({quantity:null})} onCommit={quantity => update({quantity})} />
        <span className="serving-unit-equation-name">{row.name.trim() || t('unitNewName')}</span>
        <span aria-hidden="true">=</span>
        <JournalQuantityInput name="conversionAmount" label={t('unitBaseQuantity')}
          quantity={row.amount} format={formatAmount}
          onClear={() => update({amount:null})} onCommit={amount => update({amount,unit})} />
        <span data-conversion-unit={unit}>{unit}</span>
      </div>
    </div>
    {unit !== base && <button type="button" className="text-link serving-unit-repair"
      onClick={() => update({unit:base})}>{t('unitUseNewBase',{unit:base})}</button>}
    <div className="serving-unit-remove">
      <button type="button" className="text-link clear-conversion" onClick={remove}>{t('removeServingUnit')}</button>
    </div>
  </div>;
}

export function JournalServingUnits({rows, change, base, serving, preferred, choose}: {
  rows: UnitDraft[];
  change: Dispatch<SetStateAction<UnitDraft[]>>;
  base: BaseUnit;
  serving: boolean;
  preferred: string;
  choose: (unit:string) => void;
}) {
  const {t} = useTranslation();
  const sectionId = useId();
  const nextId = useRef(rows.length);
  const addButton = useRef<HTMLButtonElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const baseLabel = t(base === 'g' ? 'unitGramLabel' : 'unitMilliliterLabel');
  const options = [
    {value:base, label:baseLabel},
    ...(serving ? [{value:'serving', label:t('servingUnit')}] : []),
    ...rows.filter(row => validConsumptionUnit(asConversion(row, base)) && (row.unit ?? base) === base)
      .map(row => ({value:String(row.id), label:row.name.trim()})),
  ];
  const current = options.find(option => option.value === preferred) ?? options[0];

  function addUnit() {
    const id = nextId.current++;
    change(previous => [...previous, {id, name:'', quantity:1, amount:null, unit:null}]);
    setExpandedId(id);
  }

  async function removeUnit(row: UnitDraft) {
    const isDefault = preferred === String(row.id);
    const warning = isDefault ? t('unitRemoveDefaultWarning',{unit:baseLabel}) : t('unitRemoveWarning');
    let removed = false;
    await confirmDelete('servingUnit',row.name.trim(),async () => {
      change(previous => previous.filter(unit => unit.id !== row.id));
      if (isDefault) choose(base);
      setExpandedId(null);
      removed = true;
    },warning);
    if (removed) requestAnimationFrame(() => addButton.current?.focus({preventScroll:true}));
  }

  return <section className="ingredient-form-section journal-serving-units">
    <h3><JournalHeading>{t('servingUnits')}</JournalHeading></h3>
    <div className="serving-unit-settings">
      <div className="serving-unit-base serving-unit-copy">
        <span className="ingredient-field-label">{t('unitBaseDescription')}</span>
        <span className="serving-unit-value">{baseLabel}</span>
      </div>
      <div className="serving-unit-default">
        <DraftUnitPicker open={menuOpen} setOpen={setMenuOpen} matchColumn
          units={{name:t('unitDefaultServing'), accessibleLabel:t('unitDefaultServing') + ' · ' + current.label, ...current,
            options, fixed:false, change:choose}}
          triggerContent={<span className="serving-unit-copy">
            <span className="ingredient-field-label">{t('unitDefaultServing')}</span>
            <span className="serving-unit-value"><span>{current.label}</span><ChevronRight size={15} aria-hidden="true" /></span>
          </span>} />
      </div>
    </div>

    <div className="serving-unit-custom">
      <h4 className="ingredient-field-label">{t('unitCustomHeading')}</h4>
      {rows.map(row => {
        const expanded = row.id === expandedId;
        const editorId = sectionId+'-unit-'+row.id;
        const Chevron = expanded ? ChevronDown : ChevronRight;
        const name = row.name.trim();
        return <div className="journal-unit-row" key={row.id}>
          <button type="button" className="journal-unit-summary" aria-expanded={expanded} aria-controls={expanded?editorId:undefined}
            onClick={() => setExpandedId(expanded ? null : row.id)}>
            <span className="serving-unit-summary-name">{name || t('unitNewName')}</span>
            {name && row.quantity !== null && row.amount !== null &&
              <small>{formatAmount(row.quantity)} {name} ≈ {formatAmount(row.amount)} {row.unit ?? base}</small>}
            <Chevron size={16} aria-hidden="true" />
          </button>
          {expanded && <CustomUnitEditor id={editorId} row={row} base={base}
            update={patch => change(previous => previous.map(unit => unit.id === row.id ? {...unit,...patch} : unit))}
            remove={() => void removeUnit(row)} />}
        </div>;
      })}
      <button type="button" className="text-link ingredient-unit-add" ref={addButton} onClick={addUnit}>
        <Plus size={15} aria-hidden="true" />{t('addServingUnit')}
      </button>
    </div>
  </section>;
}
