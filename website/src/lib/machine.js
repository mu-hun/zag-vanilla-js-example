import { createScope, INIT_STATE, MachineStatus } from "@zag-js/core";
import { subscribe } from "@zag-js/store";
import {
  compact,
  identity,
  isEqual,
  isFunction,
  isString,
  runIfFn,
  toArray,
  warn,
} from "@zag-js/utils";
import { bindable } from "./bindable";
import { createRefs } from "./refs";
export class VanillaMachine {
  machine;
  scope;
  ctx;
  prop;
  state;
  refs;
  computed;
  event = {
    type: "",
  };
  previousEvent;
  effects = new Map();
  transition = null;
  cleanups = [];
  subscriptions = [];
  getEvent = () => ({
    ...this.event,
    current: () => this.event,
    previous: () => this.previousEvent,
  });
  getState = () => ({
    ...this.state,
    matches: (...values) => values.includes(this.state.get()),
    hasTag: (tag) =>
      !!this.machine.states[this.state.get()]?.tags?.includes(tag),
  });
  debug = (...args) => {
    if (this.machine.debug) console.log(...args);
  };
  notify = () => {
    this.publish();
  };
  constructor(machine, userProps = {}) {
    this.machine = machine;
    // create scope
    const { id, ids, getRootNode } = runIfFn(userProps);
    this.scope = createScope({
      id,
      ids,
      getRootNode,
    });
    // create prop
    const prop = (key) => {
      const __props = runIfFn(userProps);
      const props =
        machine.props?.({
          props: compact(__props),
          scope: this.scope,
        }) ?? __props;
      return props[key];
    };
    this.prop = prop;
    // create context
    const context = machine.context?.({
      prop,
      bindable,
      scope: this.scope,
      flush(fn) {
        queueMicrotask(fn);
      },
      getContext() {
        return ctx;
      },
      getComputed() {
        return computed;
      },
      getRefs() {
        return refs;
      },
      getEvent: this.getEvent.bind(this),
    });
    // subscribe to context changes
    if (context) {
      Object.values(context).forEach((item) => {
        const unsub = subscribe(item.ref, () => this.notify());
        this.cleanups.push(unsub);
      });
    }
    // context function
    const ctx = {
      get(key) {
        return context?.[key].get();
      },
      set(key, value) {
        context?.[key].set(value);
      },
      initial(key) {
        return context?.[key].initial;
      },
      hash(key) {
        const current = context?.[key].get();
        return context?.[key].hash(current);
      },
    };
    this.ctx = ctx;
    const computed = (key) => {
      return (
        machine.computed?.[key]({
          context: ctx,
          event: this.getEvent(),
          prop,
          refs: this.refs,
          scope: this.scope,
          computed: computed,
        }) ?? {}
      );
    };
    this.computed = computed;
    const refs = createRefs(
      machine.refs?.({
        prop,
        context: ctx,
      }) ?? {},
    );
    this.refs = refs;
    // state
    const state = bindable(() => ({
      defaultValue: machine.initialState({
        prop,
      }),
      onChange: (nextState, prevState) => {
        // compute effects: exit -> transition -> enter
        // exit effects
        if (prevState) {
          const exitEffects = this.effects.get(prevState);
          exitEffects?.();
          this.effects.delete(prevState);
        }
        // exit actions
        if (prevState) {
          // @ts-ignore
          this.action(machine.states[prevState]?.exit);
        }
        // transition actions
        this.action(this.transition?.actions);
        // enter effect
        // @ts-ignore
        const cleanup = this.effect(machine.states[nextState]?.effects);
        if (cleanup) this.effects.set(nextState, cleanup);
        // root entry actions
        if (prevState === INIT_STATE) {
          this.action(machine.entry);
          const cleanup = this.effect(machine.effects);
          if (cleanup) this.effects.set(INIT_STATE, cleanup);
        }
        // enter actions
        // @ts-ignore
        this.action(machine.states[nextState]?.entry);
      },
    }));
    this.state = state;
    this.cleanups.push(subscribe(this.state.ref, () => this.notify()));
  }
  send = (event) => {
    if (this.status !== MachineStatus.Started) return;
    queueMicrotask(() => {
      this.previousEvent = this.event;
      this.event = event;
      this.debug("send", event);
      let currentState = this.state.get();
      const transitions = // @ts-ignore
        this.machine.states[currentState].on?.[event.type] ?? // @ts-ignore
        this.machine.on?.[event.type];
      const transition = this.choose(transitions);
      if (!transition) return;
      // save current transition
      this.transition = transition;
      const target = transition.target ?? currentState;
      this.debug("transition", transition);
      const changed = target !== currentState;
      if (changed) {
        // state change is high priority
        this.state.set(target);
      } else {
        // call transition actions
        this.action(transition.actions);
      }
    });
  };
  action = (keys) => {
    const strs = isFunction(keys) ? keys(this.getParams()) : keys;
    if (!strs) return;
    const fns = strs.map((s) => {
      const fn = this.machine.implementations?.actions?.[s];
      if (!fn)
        warn(
          `[zag-js] No implementation found for action "${JSON.stringify(s)}"`,
        );
      return fn;
    });
    for (const fn of fns) {
      fn?.(this.getParams());
    }
  };
  guard = (str) => {
    if (isFunction(str)) return str(this.getParams());
    return this.machine.implementations?.guards?.[str](this.getParams());
  };
  effect = (keys) => {
    const strs = isFunction(keys) ? keys(this.getParams()) : keys;
    if (!strs) return;
    const fns = strs.map((s) => {
      const fn = this.machine.implementations?.effects?.[s];
      if (!fn)
        warn(
          `[zag-js] No implementation found for effect "${JSON.stringify(s)}"`,
        );
      return fn;
    });
    const cleanups = [];
    for (const fn of fns) {
      const cleanup = fn?.(this.getParams());
      if (cleanup) cleanups.push(cleanup);
    }
    return () => cleanups.forEach((fn) => fn?.());
  };
  choose = (transitions) => {
    return toArray(transitions).find((t) => {
      let result = !t.guard;
      if (isString(t.guard)) result = !!this.guard(t.guard);
      else if (isFunction(t.guard)) result = t.guard(this.getParams());
      return result;
    });
  };
  start() {
    this.status = MachineStatus.Started;
    this.debug("initializing...");
    this.state.invoke(this.state.initial, INIT_STATE);
    this.setupTrackers();
  }
  stop() {
    // run exit effects
    this.effects.forEach((fn) => fn?.());
    this.effects.clear();
    this.transition = null;
    this.action(this.machine.exit);
    // unsubscribe from all subscriptions
    this.cleanups.forEach((unsub) => unsub());
    this.cleanups = [];
    this.status = MachineStatus.Stopped;
    this.debug("unmounting...");
  }
  subscribe = (fn) => {
    this.subscriptions.push(fn);
  };
  status = MachineStatus.NotStarted;
  get service() {
    return {
      state: this.getState(),
      send: this.send,
      context: this.ctx,
      prop: this.prop,
      scope: this.scope,
      refs: this.refs,
      computed: this.computed,
      event: this.getEvent(),
      getStatus: () => this.status,
    };
  }
  publish = () => {
    this.callTrackers();
    this.subscriptions.forEach((fn) => fn(this.service));
  };
  trackers = [];
  setupTrackers = () => {
    this.machine.watch?.(this.getParams());
  };
  callTrackers = () => {
    this.trackers.forEach(({ deps, fn }) => {
      const next = deps.map((dep) => dep());
      if (!isEqual(fn.prev, next)) {
        fn();
        fn.prev = next;
      }
    });
  };
  getParams = () => ({
    state: this.getState(),
    context: this.ctx,
    event: this.getEvent(),
    prop: this.prop,
    send: this.send,
    action: this.action,
    guard: this.guard,
    track: (deps, fn) => {
      fn.prev = deps.map((dep) => dep());
      this.trackers.push({
        deps,
        fn,
      });
    },
    refs: this.refs,
    computed: this.computed,
    flush: identity,
    scope: this.scope,
    choose: this.choose,
  });
}
