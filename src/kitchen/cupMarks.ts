import { CUP_ART, CUP_SURFACE_BOTTOM, CUP_SURFACE_RUN } from '../art/cupGeometry';

/**
 * Lines on the cup, as fractions of its height.
 *
 * `CUP_LIP` is the upper edge of the near lip, where a pour goes from in front of the cup to behind
 * it; the well runs from `WELL_TOP` (the brim's surface) down to `WELL_BOTTOM`.
 */
export const CUP_LIP = 28 / CUP_ART.h;
export const WELL_TOP = (CUP_SURFACE_BOTTOM - CUP_SURFACE_RUN) / CUP_ART.h;
export const WELL_BOTTOM = CUP_SURFACE_BOTTOM / CUP_ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;
