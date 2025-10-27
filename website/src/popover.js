import * as popover from "@zag-js/popover";
import { normalizeProps, spreadProps, VanillaMachine } from "./lib";
import { Component } from "./component";
export class Popover extends Component {
  initMachine(props) {
    return new VanillaMachine(popover.machine, props);
  }
  initApi() {
    return popover.connect(this.machine.service, normalizeProps);
  }
  render = () => {
    const rootEl = this.rootEl;
    const triggerEl = rootEl.querySelector(".popover-trigger");
    if (triggerEl) spreadProps(triggerEl, this.api.getTriggerProps());
    const contentEl = rootEl.querySelector(".popover-content");
    if (contentEl) spreadProps(contentEl, this.api.getContentProps());
    const positionerEl = rootEl.querySelector(".popover-positioner");
    if (positionerEl) spreadProps(positionerEl, this.api.getPositionerProps());
  };
}
