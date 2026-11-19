/* Compose the original reversible UX29 patch with the smaller studio interface. */
import {applyUX29 as applyBase, unapplyUX29 as unapplyBase} from './relief-ux29-base.mjs';
import {applySimpleStudio, unapplySimpleStudio} from './studio-simple.mjs';
export function applyUX29(files) {
  return applySimpleStudio(applyBase(files));
}
export function unapplyUX29(name, source) {
  return unapplyBase(name, unapplySimpleStudio(name, source));
}
