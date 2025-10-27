import * as combobox from "@zag-js/combobox";
import { comboboxData } from "@zag-js/shared";
import { matchSorter } from "match-sorter";
import { Component } from "./component";
import { normalizeProps, spreadProps, VanillaMachine } from "./lib";
export class Combobox extends Component {
  options = comboboxData.slice();
  setOptions(options) {
    this.options = options;
    this.renderItems();
  }
  getCollection(items) {
    return combobox.collection({
      items,
      itemToValue: (item) => item.code,
      itemToString: (item) => item.label,
    });
  }
  initMachine(props) {
    const self = this;
    return new VanillaMachine(combobox.machine, {
      ...props,
      get collection() {
        return self.getCollection(self.options || comboboxData);
      },
      onOpenChange: () => {
        self.options = comboboxData;
      },
      onInputValueChange: ({ inputValue }) => {
        const filtered = matchSorter(comboboxData, inputValue, {
          keys: ["label"],
        });
        self.options = filtered.length > 0 ? filtered : comboboxData;
      },
    });
  }
  initApi() {
    return combobox.connect(this.machine.service, normalizeProps);
  }
  renderItems = () => {
    const contentEl = this.getOrCreateContentEl();
    const existingItems = Array.from(contentEl.children);
    // Remove excess items
    while (existingItems.length > this.options.length) {
      contentEl.removeChild(existingItems.pop());
    }
    // Update or create items
    this.options.forEach((item, index) => {
      let itemEl = existingItems[index];
      if (!itemEl) {
        itemEl = this.doc.createElement("div");
        itemEl.classList.add("combobox-item");
        contentEl.appendChild(itemEl);
      }
      itemEl.innerText = item.label;
      spreadProps(
        itemEl,
        this.api.getItemProps({
          item,
        }),
      );
    });
  };
  render = () => {
    spreadProps(this.rootEl, this.api.getRootProps());
    const inputEl = this.rootEl?.querySelector(".combobox-input");
    if (inputEl) spreadProps(inputEl, this.api.getInputProps());
    const triggerEl = this.rootEl?.querySelector(".combobox-trigger");
    if (triggerEl) spreadProps(triggerEl, this.api.getTriggerProps());
    const clearTriggerEl = this.rootEl?.querySelector(
      ".combobox-clear-trigger",
    );
    if (clearTriggerEl)
      spreadProps(clearTriggerEl, this.api.getClearTriggerProps());
    const controlEl = this.rootEl?.querySelector(".combobox-control");
    if (controlEl) spreadProps(controlEl, this.api.getControlProps());
    const contentEl = this.getOrCreateContentEl();
    spreadProps(contentEl, this.api.getContentProps());
    this.renderItems();
  };
  getOrCreateContentEl = () => {
    let contentEl = this.rootEl?.querySelector(".combobox-content");
    if (!contentEl) {
      contentEl = this.doc.createElement("div");
      contentEl.classList.add("combobox-content");
      this.rootEl?.appendChild(contentEl);
    }
    return contentEl;
  };
}
