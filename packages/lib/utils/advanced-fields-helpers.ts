import { type Field, FieldType } from '@prisma/client';

import { ZFieldMetaSchema } from '../types/field-meta';

// Field types whose required flag historically DEFAULTS to optional when the
// fieldMeta `required` is unset. Other types default to required (notably
// signatures/initials, which must be completed unless deliberately made
// optional). Since SealFlow added `required` to the shared field meta and ships
// a required toggle for every type, `isRequiredField` now honors an explicit
// toggle for all types and only falls back to this default when it's unset.
export const ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING: FieldType[] = [
  FieldType.NUMBER,
  FieldType.TEXT,
  FieldType.DROPDOWN,
  FieldType.RADIO,
  FieldType.CHECKBOX,
];

/**
 * Whether a field is required to be inserted.
 *
 * Honors an explicit `fieldMeta.required` for EVERY field type. When it's unset
 * (or the meta is missing/unparseable), falls back to the type's historical
 * default so existing and auto-placed fields keep their prior behavior — data
 * fields (text/number/…) default optional, everything else defaults required.
 */
export const isRequiredField = (field: Field) => {
  const defaultRequired = !ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING.includes(field.type);

  if (!field.fieldMeta) {
    return defaultRequired;
  }

  const parsedData = ZFieldMetaSchema.safeParse(field.fieldMeta);

  // If it fails, fall back to the type's default (kept as-is; should be logged).
  if (!parsedData.success) {
    return defaultRequired;
  }

  if (typeof parsedData.data?.required === 'boolean') {
    return parsedData.data.required;
  }

  return defaultRequired;
};

/**
 * Whether the provided field is required and not inserted.
 */
export const isFieldUnsignedAndRequired = (field: Field) => isRequiredField(field) && !field.inserted;

/**
 * Whether the provided fields contains a field that is required to be inserted.
 */
export const fieldsContainUnsignedRequiredField = (fields: Field[]) => fields.some(isFieldUnsignedAndRequired);
