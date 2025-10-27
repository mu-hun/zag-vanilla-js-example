export class Component {
  rootEl;
  machine;
  api;
  get doc() {
    return this.rootEl.ownerDocument;
  }
  constructor(rootEl, props) {
    if (!rootEl) throw new Error("Root element not found");
    this.rootEl = rootEl;
    this.machine = this.initMachine(props);
    this.api = this.initApi();
  }
  init = () => {
    this.render();
    this.machine.subscribe(() => {
      this.api = this.initApi();
      this.render();
    });
    this.machine.start();
  };
  destroy = () => {
    this.machine.stop();
  };
}
