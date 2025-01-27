/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./terminal-window.scss";

import React from "react";
import { disposeOnUnmount, observer } from "mobx-react";
import { cssNames } from "../../../utils";
import type { Terminal } from "./terminal";
import type { TerminalStore } from "./store";
import { ThemeStore } from "../../../theme.store";
import type { DockTab, DockStore } from "../dock/store";
import { withInjectables } from "@ogre-tools/injectable-react";
import dockStoreInjectable from "../dock/store.injectable";
import terminalStoreInjectable from "./store.injectable";

export interface TerminalWindowProps {
  tab: DockTab;
}

interface Dependencies {
  dockStore: DockStore;
  terminalStore: TerminalStore;
}

@observer
class NonInjectedTerminalWindow extends React.Component<TerminalWindowProps & Dependencies> {
  public elem: HTMLElement;
  public terminal: Terminal;

  componentDidMount() {
    this.props.terminalStore.connect(this.props.tab);
    this.terminal = this.props.terminalStore.getTerminal(this.props.tab.id);
    this.terminal.attachTo(this.elem);

    disposeOnUnmount(this, [
      // refresh terminal available space (cols/rows) when <Dock/> resized
      this.props.dockStore.onResize(() => this.terminal.onResize(), {
        fireImmediately: true,
      }),
    ]);
  }

  componentDidUpdate(): void {
    this.terminal.detach();
    this.props.terminalStore.connect(this.props.tab);
    this.terminal = this.props.terminalStore.getTerminal(this.props.tab.id);
    this.terminal.attachTo(this.elem);
  }

  componentWillUnmount(): void {
    this.terminal.detach();
  }

  render() {
    return (
      <div
        className={cssNames("TerminalWindow", ThemeStore.getInstance().activeTheme.type)}
        ref={elem => this.elem = elem}
      />
    );
  }
}

export const TerminalWindow = withInjectables<Dependencies, TerminalWindowProps>(NonInjectedTerminalWindow, {
  getProps: (di, props) => ({
    dockStore: di.inject(dockStoreInjectable),
    terminalStore: di.inject(terminalStoreInjectable),
    ...props,
  }),
});

