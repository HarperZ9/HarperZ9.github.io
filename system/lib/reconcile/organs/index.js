// The organ library -- register every generator so the engine can list, pick, and compose them.
import { register } from "../organ.js";
import { FIELD_ORGANS } from "./fields.js";
import { FORM_ORGANS } from "./forms.js";

export const ALL_ORGANS = [...FIELD_ORGANS, ...FORM_ORGANS];
register(...ALL_ORGANS);

export { FIELD_ORGANS, FORM_ORGANS };
