import * as checkbox from "@zag-js/checkbox";
import { normalizeProps, spreadProps, VanillaMachine } from "./lib";
import { Component } from "./component";
export class Checkbox extends Component {
  initMachine(props) {
    return new VanillaMachine(checkbox.machine, props);
  }
  initApi() {
    return checkbox.connect(this.machine.service, normalizeProps);
  }
  render = () => {
    const rootEl = this.rootEl;
    spreadProps(this.rootEl, this.api.getRootProps());
    const controlEl = rootEl.querySelector(".checkbox-control");
    if (controlEl) spreadProps(controlEl, this.api.getControlProps());
    const labelEl = rootEl.querySelector(".checkbox-label");
    if (labelEl) spreadProps(labelEl, this.api.getLabelProps());
    const inputEl = rootEl.querySelector(".checkbox-input");
    if (inputEl) spreadProps(inputEl, this.api.getHiddenInputProps());
  };
}
