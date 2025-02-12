/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./kube-object-list-layout.scss";

import React from "react";
import { computed, makeObservable, observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import { cssNames, Disposer } from "../../utils";
import type { KubeObject } from "../../../common/k8s-api/kube-object";
import { ItemListLayout, ItemListLayoutProps } from "../item-object-list/list-layout";
import type { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { KubeObjectMenu } from "../kube-object-menu";
import { NamespaceSelectFilter } from "../+namespaces/namespace-select-filter";
import { ResourceKindMap, ResourceNames } from "../../utils/rbac";
import { kubeSelectedUrlParam, toggleDetails } from "../kube-detail-params";
import { Icon } from "../icon";
import { TooltipPosition } from "../tooltip";
import { withInjectables } from "@ogre-tools/injectable-react";
import type { ClusterFrameContext } from "../../cluster-frame-context/cluster-frame-context";
import clusterFrameContextInjectable from "../../cluster-frame-context/cluster-frame-context.injectable";
import kubeWatchApiInjectable from "../../kube-watch-api/kube-watch-api.injectable";
import type { KubeWatchSubscribeStoreOptions } from "../../kube-watch-api/kube-watch-api";

type ItemListLayoutPropsWithoutGetItems<K extends KubeObject> = Omit<ItemListLayoutProps<K>, "getItems">;

export interface KubeObjectListLayoutProps<K extends KubeObject> extends ItemListLayoutPropsWithoutGetItems<K> {
  items?: K[];
  getItems?: () => K[];
  store: KubeObjectStore<K>;
  dependentStores?: KubeObjectStore<KubeObject>[];
  subscribeStores?: boolean;
}

const defaultProps: Partial<KubeObjectListLayoutProps<KubeObject>> = {
  onDetails: (item: KubeObject) => toggleDetails(item.selfLink),
  subscribeStores: true,
};

interface Dependencies {
  clusterFrameContext: ClusterFrameContext;
  subscribeToStores: (stores: KubeObjectStore<KubeObject>[], options: KubeWatchSubscribeStoreOptions) => Disposer;
}

@observer
class NonInjectedKubeObjectListLayout<K extends KubeObject> extends React.Component<KubeObjectListLayoutProps<K> & Dependencies> {
  static defaultProps = defaultProps as object;

  constructor(props: KubeObjectListLayoutProps<K> & Dependencies) {
    super(props);
    makeObservable(this);
  }

  @observable loadErrors: string[] = [];

  @computed get selectedItem() {
    return this.props.store.getByPath(kubeSelectedUrlParam.get());
  }

  componentDidMount() {
    const { store, dependentStores = [], subscribeStores } = this.props;
    const stores = Array.from(new Set([store, ...dependentStores]));
    const reactions: Disposer[] = [
      reaction(() => this.props.clusterFrameContext.contextNamespaces.slice(), () => {
        // clear load errors
        this.loadErrors.length = 0;
      }),
    ];

    if (subscribeStores) {
      reactions.push(
        this.props.subscribeToStores(stores, {
          onLoadFailure: error => this.loadErrors.push(String(error)),
        }),
      );
    }

    disposeOnUnmount(this, reactions);
  }

  renderLoadErrors() {
    if (this.loadErrors.length === 0) {
      return null;
    }

    return (
      <Icon
        material="warning"
        className="load-error"
        tooltip={{
          children: (
            <>
              {this.loadErrors.map((error, index) => <p key={index}>{error}</p>)}
            </>
          ),
          preferredPositions: TooltipPosition.BOTTOM,
        }}
      />
    );
  }

  render() {
    const { className, customizeHeader, store, items, ...layoutProps } = this.props;
    const placeholderString = ResourceNames[ResourceKindMap[store.api.kind]] || store.api.kind;

    return (
      <ItemListLayout
        className={cssNames("KubeObjectListLayout", className)}
        store={store}
        getItems={() => this.props.items || store.contextItems}
        preloadStores={false} // loading handled in kubeWatchApi.subscribeStores()
        detailsItem={this.selectedItem}
        customizeHeader={[
          ({ filters, searchProps, info, ...headerPlaceHolders }) => ({
            filters: (
              <>
                {filters}
                {store.api.isNamespaced && <NamespaceSelectFilter />}
              </>
            ),
            searchProps: {
              ...searchProps,
              placeholder: `Search ${placeholderString}...`,
            },
            info: (
              <>
                {info}
                {this.renderLoadErrors()}
              </>
            ),
            ...headerPlaceHolders,
          }),
          ...[customizeHeader].flat(),
        ]}
        renderItemMenu={item => <KubeObjectMenu object={item} />}
        {...layoutProps}
      />
    );
  }
}

const InjectedKubeObjectListLayout = withInjectables<Dependencies, KubeObjectListLayoutProps<KubeObject>>(NonInjectedKubeObjectListLayout, {
  getProps: (di, props) => ({
    clusterFrameContext: di.inject(clusterFrameContextInjectable),
    subscribeToStores: di.inject(kubeWatchApiInjectable).subscribeStores,
    ...props,
  }),
});

export function KubeObjectListLayout<K extends KubeObject>(props: KubeObjectListLayoutProps<K>) {
  return <InjectedKubeObjectListLayout {...props} />;
}
