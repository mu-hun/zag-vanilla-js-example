import { VanillaMachine } from "../src/lib/machine";
import { spreadProps } from "../src/lib/spread-props";
const counter = new VanillaMachine({
  context({ bindable }) {
    return {
      value: bindable(() => ({
        defaultValue: 0,
      })),
    };
  },
  initialState() {
    return "idle";
  },
  states: {
    idle: {
      on: {
        INC: {
          actions: ["increment"],
        },
        DEC: {
          actions: ["decrement"],
        },
        SPIN: {
          target: "ticking",
          actions: ["increment"],
        },
      },
    },
    ticking: {
      effects: ["keepTicking"],
      on: {
        TICK: {
          actions: ["increment"],
        },
        STOP: {
          target: "idle",
        },
      },
    },
  },
  watch({ track, context }) {
    track([() => context.get("value")], () => {
      console.log("value changed", context.get("value"));
    });
  },
  implementations: {
    actions: {
      increment({ context }) {
        context.set("value", context.get("value") + 1);
      },
      decrement({ context }) {
        context.set("value", context.get("value") - 1);
      },
    },
    effects: {
      keepTicking({ context }) {
        const id = setInterval(() => {
          context.set("value", context.get("value") + 1);
        }, 1000);
        return () => clearInterval(id);
      },
    },
  },
});
const connect = (service) => {
  const { context, send, state } = service;
  return {
    value: context.get("value"),
    incProps: {
      type: "button",
      onClick: () =>
        send({
          type: "INC",
        }),
    },
    decProps: {
      type: "button",
      onClick: () =>
        send({
          type: "DEC",
        }),
    },
    inputProps: {
      type: "text",
      value: context.get("value"),
    },
    spinProps: {
      type: "button",
      onClick: () =>
        send({
          type: "SPIN",
        }),
      hidden: state.matches("ticking"),
    },
    stopProps: {
      type: "button",
      onClick: () =>
        send({
          type: "STOP",
        }),
      hidden: !state.matches("ticking"),
    },
  };
};
const render = (service) => {
  const api = connect(service);
  const inputEl = document.querySelector("#input");
  if (inputEl) spreadProps(inputEl, api.inputProps);
  const incEl = document.querySelector("#inc");
  if (incEl) spreadProps(incEl, api.incProps);
  const decEl = document.querySelector("#dec");
  if (decEl) spreadProps(decEl, api.decProps);
  const spinEl = document.querySelector("#spin");
  if (spinEl) spreadProps(spinEl, api.spinProps);
  const stopEl = document.querySelector("#stop");
  if (stopEl) spreadProps(stopEl, api.stopProps);
};
render(counter.service);
counter.subscribe((service) => {
  render(service);
});
counter.start();
