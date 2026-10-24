import { CUP_ART, CUP_SURFACE_BOTTOM, CUP_SURFACE_RUN } from '../art/cupGeometry';

/**
 * Lines on the cup, as fractions of its height.
 *
 * The stream stays visible through the open mouth until it touches the projected surface.
 * Its deepest endpoint is the empty floor; it rises to the mouth center as the cup fills.
 */
export const CUP_LIP = CUP_SURFACE_BOTTOM / CUP_ART.h;
export const WELL_TOP = (CUP_SURFACE_BOTTOM - CUP_SURFACE_RUN) / CUP_ART.h;
export const WELL_BOTTOM = CUP_SURFACE_BOTTOM / CUP_ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;
